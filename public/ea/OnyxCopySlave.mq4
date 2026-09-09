//+------------------------------------------------------------------+
//| OnyxCopySlave.mq4  ·  PLANTILLA (Fase 2 · MetaTrader 4)           |
//| Pide comandos a Onyx, resuelve el símbolo local, calcula el      |
//| lote según el modo, aplica los LÍMITES de riesgo del enlace y    |
//| ejecuta.                                                         |
//|                                                                  |
//| Whitelist de WebRequest igual que el master.                     |
//| Pega tu CLAVE COPY de esta cuenta (empieza por "onyx_copy_").    |
//|                                                                  |
//| EJECUCION IMPLEMENTADA: parsea, resuelve símbolo, calcula lote,  |
//| aplica límites y abre/cierra con OrderSend/OrderClose.           |
//| IMPORTANTE: pruébala PRIMERO en cuenta DEMO antes de dinero real.|
//+------------------------------------------------------------------+
#property strict

extern string ApiBase    = "https://www.onyxtradinglive.com";
extern string CopyApiKey = "PON_TU_CLAVE_COPY";   // onyx_copy_...  (no hace falta en modo Local)
extern int    PollMs     = 500;                   // Nube: cada cuanto pregunta (ms). 300-500 = mas rapido. Local usa 100 solo.
extern int    Slippage   = 30;
extern string PanelLang  = "EN";                  // Panel: ES=Español, otro=English (web/IA/Telegram en 6 idiomas)
extern string SymbolMap  = "";                    // Tabla manual master=esclava. Ej: US100=NAS100;GOLD=XAUUSD.pro;EURUSD=EURUSDm
string g_cloudMap = "";           // tabla de simbolos que llega de la web (por comando)
// ---- Modo LOCAL (mismo VPS): lee el archivo comun del master ----
extern bool   LocalMode      = false;
extern string CopyChannel    = "onyx1";           // Mismo nombre que el master del mismo VPS
extern string LocalSizing    = "multiplier";      // multiplier | balance
extern double LocalMult      = 1.0;
extern double LocalMaxLot    = 0;
extern double LocalMaxSpread = 0;
extern double LocalDailyLoss = 0;
extern double LocalMaxDd      = 0;

string L(string en, string es){ return (StringFind(PanelLang, "ES") == 0) ? es : en; }

double g_dayStartEquity = 0;
int    g_dayStamp       = -1;
int    g_localDone      = 0;

// Config EFECTIVA en modo Local (inputs Local* o, si hay clave, la de la web).
string gMode; double gMult, gRisk, gPip, gMaxLot, gMaxSpr, gDLoss, gMDD;

//==================== PANEL EN EL GRAFICO ====================
// Igual que Onyx Guardian. Borde: verde=conectada · ambar=esperando · rojo=pausada.
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

int OnInit()
{
   if(!LocalMode && StringFind(CopyApiKey, "onyx_copy_") != 0)
      Print("AVISO: CopyApiKey no parece una clave Copy (debe empezar por onyx_copy_).");
   g_dayStartEquity = AccountEquity();
   g_dayStamp = DayOfYear();
   InitLocalCfg();
   if(LocalMode)
   {
      g_localDone = CountLocalLines();
      FetchLocalConfig();
   }
   EventSetMillisecondTimer(LocalMode ? 100 : PollMs);
   DrawPanel();
   return(INIT_SUCCEEDED);
}

void InitLocalCfg()
{
   gMode = LocalSizing; gMult = LocalMult; gRisk = 0; gPip = 0;
   gMaxLot = LocalMaxLot; gMaxSpr = LocalMaxSpread; gDLoss = LocalDailyLoss; gMDD = LocalMaxDd;
}
void FetchLocalConfig()
{
   if(StringFind(CopyApiKey, "onyx_copy_") != 0) return;
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
void OnDeinit(const int reason){ EventKillTimer(); DelPanel(); }

// GET de comandos pendientes.
string GetCommands()
{
   char post[]; char result[]; string rh;
   string headers = "x-onyx-key: " + CopyApiKey + "\r\n";
   ResetLastError();
   int code = WebRequest("GET", ApiBase + "/api/v1/copy/slave", headers, 5000, post, result, rh);
   if(code != 200){ if(code==-1) Print("WebRequest err ", GetLastError()); g_state=1; return(""); }
   string body = CharArrayToString(result);
   g_state = (StringFind(body, "\"paused\":true") >= 0) ? 0 : 2;
   return(body);
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
//--- ¿Dos símbolos normalizados son el mismo par, admitiendo un sufijo de letras (.sim, m, .pro, ecn…)?
bool SymMatch(string a, string b)
{
   if(a == b) return(true);
   string lng = (StringLen(a) >= StringLen(b)) ? a : b;          // el más largo
   string sht = (StringLen(a) >= StringLen(b)) ? b : a;          // el más corto
   int ls = StringLen(sht), ll = StringLen(lng);
   if(ll > ls && (ll - ls) <= 5 && StringSubstr(lng,0,ls) == sht){
      string rest = StringSubstr(lng, ls);                       // p.ej. "M", "PRO", "ECN", "SIM"
      for(int k=0;k<StringLen(rest);k++){ int c = StringGetChar(rest,k); if(c < 'A' || c > 'Z') return(false); }
      return(true);
   }
   return(false);
}
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
      for(int j=0;j<nm;j++) if(SymMatch(want, mem[j])) return(g[i]);
   }
   return("");
}
//--- Tabla manual master=esclava. Prioridad: 1) tabla de la web (nube), 2) input local SymbolMap.
string MapOverrideSrc(string masterSymbol, string src)
{
   if(src == "") return("");
   string pairs[]; int np = StringSplit(src, ';', pairs);
   string mUp = masterSymbol; StringToUpper(mUp);
   for(int i=0;i<np;i++){
      string kv[]; int nk = StringSplit(pairs[i], '=', kv);
      if(nk < 2) continue;
      string left = kv[0]; StringTrimLeft(left); StringTrimRight(left); StringToUpper(left);
      string right = kv[1]; StringTrimLeft(right); StringTrimRight(right);
      if(right == "") continue;
      if(left == mUp || SymMatch(NormalizeSym(left), NormalizeSym(masterSymbol))){
         if(SymbolSelect(right, true) && MarketInfo(right, MODE_POINT) > 0) return(right);
         return("");
      }
   }
   return("");
}
string MapOverride(string masterSymbol)
{
   string r = MapOverrideSrc(masterSymbol, g_cloudMap);
   if(r != "") return(r);
   return MapOverrideSrc(masterSymbol, SymbolMap);
}
string ResolveLocalSymbol(string masterSymbol)
{
   string ov = MapOverride(masterSymbol);
   if(ov != "") return(ov);                                          // 0) tabla manual (máxima prioridad)
   if(MarketInfo(masterSymbol, MODE_BID) > 0) return(masterSymbol);   // 1) existe tal cual
   string want = NormalizeSym(masterSymbol);
   int total = SymbolsTotal(false);
   // Pase 1: mismo par con o sin sufijo de broker (EURUSDm, EURUSD.pro, XAUUSDecn…)
   for(int i=0;i<total;i++){
      string s = SymbolName(i, false);
      if(SymMatch(NormalizeSym(s), want)) return(s);
   }
   // Pase 2: alias de índices/metales (GOLD↔XAUUSD, US100↔NAS100, GER40↔DE40…)
   string alias = AliasList(want);
   if(alias != ""){
      string mem[]; int n = StringSplit(alias, ',', mem);
      for(int m=0;m<n;m++)
         for(int i=0;i<total;i++){
            string s = SymbolName(i, false);
            if(SymMatch(NormalizeSym(s), mem[m])) return(s);
         }
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

//============================================================
// Mini-parser JSON para la forma conocida de nuestros comandos.
//============================================================
string JVal(string obj, string key)
{
   string pat = "\"" + key + "\"";
   int p = StringFind(obj, pat); if(p < 0) return("");
   p = StringFind(obj, ":", p + StringLen(pat)); if(p < 0) return("");
   p++;
   int n = StringLen(obj);
   while(p < n && StringGetChar(obj, p) == ' ') p++;
   if(p >= n) return("");
   int c = StringGetChar(obj, p);
   if(c == '"'){ int e = StringFind(obj, "\"", p + 1); if(e < 0) return(""); return(StringSubstr(obj, p + 1, e - (p + 1))); }
   if(c == '{' || c == '['){
      int op = c, cl = (c == '{') ? '}' : ']'; int depth = 0;
      for(int i = p; i < n; i++){ int ch = StringGetChar(obj, i); if(ch == op) depth++; else if(ch == cl){ depth--; if(depth == 0) return(StringSubstr(obj, p, i - p + 1)); } }
      return("");
   }
   int e2 = p; while(e2 < n){ int ch2 = StringGetChar(obj, e2); if(ch2 == ',' || ch2 == '}' || ch2 == ']') break; e2++; }
   string v = StringSubstr(obj, p, e2 - p); StringTrimLeft(v); StringTrimRight(v); return(v);
}
double JNum(string obj, string key){ string v = JVal(obj, key); if(v == "" || v == "null") return(0.0); return(StringToDouble(v)); }

int JSplit(string arr, string &out[])
{
   int cnt = 0, depth = 0, start = -1, n = StringLen(arr);
   for(int i = 0; i < n; i++){
      int ch = StringGetChar(arr, i);
      if(ch == '{'){ if(depth == 0) start = i; depth++; }
      else if(ch == '}'){ depth--; if(depth == 0 && start >= 0){ ArrayResize(out, cnt + 1); out[cnt] = StringSubstr(arr, start, i - start + 1); cnt++; start = -1; } }
   }
   return(cnt);
}

//--- Mapa master_ticket -> orden esclava (para poder cerrar lo que abrimos).
long g_mMaster[]; int g_mSlave[]; int g_mN = 0;
void MapAdd(long mt, int st){ ArrayResize(g_mMaster, g_mN + 1); ArrayResize(g_mSlave, g_mN + 1); g_mMaster[g_mN] = mt; g_mSlave[g_mN] = st; g_mN++; }
int  MapGet(long mt){ for(int i = 0; i < g_mN; i++) if(g_mMaster[i] == mt) return(g_mSlave[i]); return(0); }
int    CountMyPositions(){ int c=0; for(int i=OrdersTotal()-1;i>=0;i--){ if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES)) continue; if(OrderMagicNumber()==ONYX_MAGIC && OrderType()<=OP_SELL) c++; } return(c); }
double SumMyLots(string sym){ double v=0; for(int i=OrdersTotal()-1;i>=0;i--){ if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES)) continue; if(OrderMagicNumber()==ONYX_MAGIC && OrderSymbol()==sym) v+=OrderLots(); } return(v); }

#define ONYX_MAGIC 990201

//--- Cierra la orden ligada al ticket de la master (por mapa o por comentario).
bool CloseByMaster(long mt)
{
   int tk = MapGet(mt);
   string want = "OC" + (string)mt;
   for(int i = OrdersTotal() - 1; i >= 0; i--){
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderMagicNumber() != ONYX_MAGIC) continue;
      if(OrderTicket() == tk || StringFind(OrderComment(), want) >= 0){
         double px = (OrderType() == OP_BUY) ? MarketInfo(OrderSymbol(), MODE_BID) : MarketInfo(OrderSymbol(), MODE_ASK);
         return(OrderClose(OrderTicket(), OrderLots(), px, Slippage, clrNONE));
      }
   }
   return(false);
}

//============================================================
// MODO LOCAL (mismo VPS): lee el archivo comun del master.
//============================================================
int CountLocalLines()
{
   string fn = "onyx_local_" + CopyChannel + ".jsonl";
   int h = FileOpen(fn, FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ|FILE_SHARE_WRITE);
   if(h == INVALID_HANDLE) return(0);
   int c = 0;
   while(!FileIsEnding(h)){ string ln = FileReadString(h); if(StringLen(ln) > 0) c++; }
   FileClose(h);
   return(c);
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
   long   mt  = StringToInteger(mtk);
   int    t0  = (int)GetTickCount();

   if(ev == "open"){
      if(RiskStop(gDLoss, gMDD)){ g_skipped++; return; }
      string local = ResolveLocalSymbol(sym);
      if(local == ""){ g_skipped++; return; }
      if(SpreadTooHigh(local, gMaxSpr)){ g_skipped++; return; }
      double lot = ApplyMaxLot(CalcLot(local, gMode, vol, mbal, gMult, gRisk, gPip), gMaxLot);
      int type = (side == "buy") ? OP_BUY : OP_SELL;
      double px = (type == OP_BUY) ? MarketInfo(local, MODE_ASK) : MarketInfo(local, MODE_BID);
      int tk = OrderSend(local, type, lot, px, Slippage, sl, tp, "OC" + mtk, ONYX_MAGIC, 0, clrNONE);
      int lat = GetTickCount() - t0;
      if(tk > 0){ MapAdd(mt, tk); g_copied++; g_lat = lat; g_masterInfo = "#" + mtk; }
      else g_skipped++;
   }
   else if(ev == "close") CloseByMaster(mt);
}

void ProcessLocal()
{
   string fn = "onyx_local_" + CopyChannel + ".jsonl";
   int h = FileOpen(fn, FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ|FILE_SHARE_WRITE);
   if(h == INVALID_HANDLE){ g_state = 1; return; }
   g_state = 2;
   string lines[]; int cnt = 0;
   while(!FileIsEnding(h)){ string ln = FileReadString(h); if(StringLen(ln) > 0){ ArrayResize(lines, cnt + 1); lines[cnt] = ln; cnt++; } }
   FileClose(h);
   for(int i = g_localDone; i < cnt; i++) HandleLocalEvent(lines[i]);
   if(cnt > g_localDone) g_localDone = cnt;
}

void OnTimer()
{
   if(LocalMode){ ProcessLocal(); DrawPanel(); return; }

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
      g_cloudMap    = JVal(pl, "symbol_map_str");
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
      double mPrice = JNum(o,   "price");
      double ageMs  = JNum(o,   "age_ms");
      double maxDev = JNum(lim, "max_deviation_pts");
      double maxAge = JNum(lim, "max_signal_age_s");
      double reqSL  = JNum(lim, "require_sl");
      double maxPos = JNum(lim, "max_positions");
      double symCap = JNum(lim, "per_symbol_lot_cap");
      long   mt     = StringToInteger(mtk);
      int    t0     = (int)GetTickCount();

      if(action == "open"){
         if(RiskStop(dLoss, mDD)){ Ack(id, false, "risk_stop", 0, 0); g_skipped++; continue; }
         string local = ResolveLocalSymbol(bsym);
         if(local == ""){ Ack(id, false, "symbol_not_found", 0, 0); g_skipped++; continue; }
         if(SpreadTooHigh(local, maxSpr)){ Ack(id, false, "spread_high", 0, 0); g_skipped++; continue; }
         if(maxAge > 0 && ageMs > maxAge*1000.0){ Ack(id, false, "signal_old", 0, 0); g_skipped++; continue; }
         if(reqSL >= 1 && sl <= 0){ Ack(id, false, "no_sl", 0, 0); g_skipped++; continue; }
         if(maxPos > 0 && CountMyPositions() >= (int)maxPos){ Ack(id, false, "max_positions", 0, 0); g_skipped++; continue; }
         int type = (side == "buy") ? OP_BUY : OP_SELL;
         double px = (type == OP_BUY) ? MarketInfo(local, MODE_ASK) : MarketInfo(local, MODE_BID);
         if(maxDev > 0 && mPrice > 0){
            double pt2 = MarketInfo(local, MODE_POINT);
            if(pt2 > 0 && MathAbs(px - mPrice)/pt2 > maxDev){ Ack(id, false, "deviation", 0, 0); g_skipped++; continue; }
         }
         double lot = ApplyMaxLot(CalcLot(local, mode, vol, mBal, mult, riskPct, pip), maxLot);
         if(symCap > 0 && SumMyLots(local) + lot > symCap){ Ack(id, false, "symbol_cap", 0, 0); g_skipped++; continue; }
         int tk = OrderSend(local, type, lot, px, Slippage, sl, tp, "OC" + mtk, ONYX_MAGIC, 0, clrNONE);
         int lat = GetTickCount() - t0;
         if(tk > 0){ MapAdd(mt, tk); g_copied++; g_lat = lat; g_masterInfo = "#" + mtk; Ack(id, true, "", tk, lat); }
         else      { g_skipped++; Ack(id, false, "open_fail", 0, lat); }
      }
      else if(action == "close"){
         int lat = GetTickCount() - t0;
         bool done = CloseByMaster(mt);
         Ack(id, done, done ? "" : "close_fail", MapGet(mt), lat);
      }
      // "modify" (ajustar SL/TP) se puede añadir aquí con OrderModify.
   }
}
