//+------------------------------------------------------------------+
//|                                             OnyxManager_MT4.mq4   |
//|                     Onyx Trading Live - Gestor de operaciones     |
//|                                                                   |
//|  ONYX NUNCA ABRE OPERACIONES. Solo gestiona las que tu abres:     |
//|  mueve el stop a break even, hace trailing, cierra por partes y   |
//|  aplica el plan de trading que tu mismo configuraste en la web.   |
//|                                                                   |
//|  Toda la configuracion se hace en onyxtradinglive.com. Aqui solo  |
//|  pegas tu clave. El EA no decide nada por su cuenta.              |
//|                                                                   |
//|  IMPORTANTE: Herramientas -> Opciones -> Asesores Expertos,       |
//|  marca "Permitir WebRequest para" y anade tu dominio.             |
//+------------------------------------------------------------------+
#property copyright "Onyx Trading Live"
#property version   "2.00"
#property strict
#property description "Gestiona tus operaciones de MT4 segun tu configuracion en Onyx. Nunca abre operaciones."

#define EA_VERSION "2.0-MT4"
#define PREFIX     "ONYXM_"

//==================== ENTRADAS ====================================
enum ENUM_ONYX_LANG { ONYX_ES = 0, ONYX_EN = 1 };

extern string           ApiKey       = "";                                    // API key (onyxtradinglive.com)
extern ENUM_ONYX_LANG   Idioma       = ONYX_ES;                               // Idioma / Language
extern string           ServidorUrl  = "https://www.onyxtradinglive.com/api/v1/sync"; // No lo cambies salvo que te lo pidamos

//==================== ESTADO ======================================
string   g_url;
int      g_login      = 0;
int      g_cfgVersion = -1;
bool     g_managerOn  = false;
string   g_units      = "pips";

bool     g_beOn = false;   double g_beTrigger = 15;   string g_beMode = "above";
double   g_beOffset = 2;   bool   g_beCosts = true;

bool     g_trOn = false;   double g_trStart = 20;     double g_trDistance = 20;

bool     g_ptOn = false;
double   g_ptAt[4];
double   g_ptClose[4];
int      g_ptCount = 0;

//---- Fase 2: mi plan de trading y limites -------------------------
bool     g_allowNew    = true;
bool     g_forceClose  = false;
string   g_blockReason = "";
string   g_blockMsg    = "";
datetime g_blockSince  = 0;
bool     g_guardOn     = false;

bool     g_wkOn   = false;
int      g_wkDay  = 5;
int      g_wkHour = 20;
int      g_wkMin  = 0;
datetime g_wkDoneAt = 0;

datetime g_lastSyncOk  = 0;
datetime g_lastClose   = 0;      // ultima operacion cerrada que ya enviamos
string   g_lastError   = "";
string   g_events      = "";
string   g_doneCmds    = "";

int   PY = 22;
color COL_BG   = C'26,33,51';
color COL_LINE = C'56,69,95';
color COL_TX   = C'242,245,251';
color COL_MUT  = C'154,166,189';
color COL_ON   = C'52,226,160';
color COL_OFF  = C'90,100,120';
color COL_RED  = C'255,107,125';

//==================== DECLARACIONES ADELANTADAS ===================
void   RunCommand(string cmd);
void   DrawPanel();
void   EnforceGuard();
void   WeekendCheck();
void   ManageAll();

//==================== TEXTOS BILINGUES ============================
string T(string es, string en) { return (Idioma == ONYX_ES ? es : en); }

//==================== LECTOR DE JSON MINIMO =======================
// No necesitamos una libreria entera: nuestras respuestas son planas
// y conocidas. Esto es pequeno, se lee de un vistazo y no falla raro.

// Devuelve el contenido de un objeto {...} asociado a "key"
string JsonSection(string src, string key)
  {
   string pat = "\"" + key + "\":{";
   int p = StringFind(src, pat);
   if(p < 0) return "";
   int start = p + StringLen(pat) - 1;
   int depth = 0;
   for(int i = start; i < StringLen(src); i++)
     {
      string ch = StringSubstr(src, i, 1);
      if(ch == "{") depth++;
      if(ch == "}")
        {
         depth--;
         if(depth == 0) return StringSubstr(src, start, i - start + 1);
        }
     }
   return "";
  }

// Devuelve el contenido de un array [...] asociado a "key"
string JsonArray(string src, string key)
  {
   string pat = "\"" + key + "\":[";
   int p = StringFind(src, pat);
   if(p < 0) return "";
   int start = p + StringLen(pat) - 1;
   int depth = 0;
   for(int i = start; i < StringLen(src); i++)
     {
      string ch = StringSubstr(src, i, 1);
      if(ch == "[") depth++;
      if(ch == "]")
        {
         depth--;
         if(depth == 0) return StringSubstr(src, start, i - start + 1);
        }
     }
   return "";
  }

// Valor crudo de "key" hasta la coma o el cierre
string JsonRaw(string src, string key)
  {
   string pat = "\"" + key + "\":";
   int p = StringFind(src, pat);
   if(p < 0) return "";
   int i = p + StringLen(pat);
   while(i < StringLen(src) && StringSubstr(src, i, 1) == " ") i++;
   int start = i;
   bool inStr = false;
   for(; i < StringLen(src); i++)
     {
      string ch = StringSubstr(src, i, 1);
      if(ch == "\"" && (i == start || StringSubstr(src, i - 1, 1) != "\\")) inStr = !inStr;
      if(!inStr && (ch == "," || ch == "}" || ch == "]")) break;
     }
   return StringSubstr(src, start, i - start);
  }

double JsonNum(string src, string key, double def)
  {
   string v = JsonRaw(src, key);
   if(v == "" || v == "null") return def;
   return StringToDouble(v);
  }

bool JsonBool(string src, string key, bool def)
  {
   string v = JsonRaw(src, key);
   if(v == "") return def;
   if(StringFind(v, "true") >= 0)  return true;
   if(StringFind(v, "false") >= 0) return false;
   return def;
  }

string JsonStr(string src, string key, string def)
  {
   string v = JsonRaw(src, key);
   if(v == "" || v == "null") return def;
   if(StringLen(v) >= 2 && StringSubstr(v, 0, 1) == "\"")
      return StringSubstr(v, 1, StringLen(v) - 2);
   return v;
  }

//==================== UTILIDADES ==================================
string Esc(string s)
  {
   string o = "";
   for(int i = 0; i < StringLen(s); i++)
     {
      string ch = StringSubstr(s, i, 1);
      if(ch == "\"" || ch == "\\") o = o + "\\" + ch;
      else if(ch == "\n" || ch == "\r" || ch == "\t") o = o + " ";
      else o = o + ch;
     }
   return o;
  }

// Guarda un evento para enviarlo en la siguiente sincronizacion
void LogEvent(string kind, string detail, string symbol = "", int ticket = 0, double amount = 0)
  {
   if(g_events != "") g_events += ",";
   g_events += "{\"kind\":\"" + kind + "\",\"detail\":\"" + Esc(detail) + "\"";
   if(symbol != "") g_events += ",\"symbol\":\"" + Esc(symbol) + "\"";
   if(ticket != 0)  g_events += ",\"ticket\":" + IntegerToString(ticket);
   if(amount != 0)  g_events += ",\"amount\":" + DoubleToString(amount, 2);
   g_events += "}";
  }

// Un pip son 10 puntos en brokers de 5 y 3 decimales
double PipSize(string sym)
  {
   double pt  = MarketInfo(sym, MODE_POINT);
   int    dig = (int)MarketInfo(sym, MODE_DIGITS);
   if(pt <= 0) pt = Point;
   if(dig == 3 || dig == 5) return pt * 10.0;
   return pt;
  }

// Cuanto dinero mueve un punto con un lote. Sirve para el calculo de costes.
double MoneyPerPointPerLot(string sym)
  {
   double tv = MarketInfo(sym, MODE_TICKVALUE);
   double ts = MarketInfo(sym, MODE_TICKSIZE);
   double pt = MarketInfo(sym, MODE_POINT);
   if(ts <= 0 || pt <= 0) return 0;
   return tv * (pt / ts);
  }

// Convierte pips / R / dinero a una distancia de precio
double UnitsToPrice(string sym, double value, double lots, double entry, double sl)
  {
   if(g_units == "pips") return value * PipSize(sym);

   if(g_units == "r")
     {
      // 1R es la distancia del stop. Sin stop no hay R que valga.
      if(sl <= 0 || entry <= 0) return 0;
      return MathAbs(entry - sl) * value;
     }

   // dinero
   double mpp = MoneyPerPointPerLot(sym);
   if(mpp <= 0 || lots <= 0) return 0;
   return (value / (mpp * lots)) * MarketInfo(sym, MODE_POINT);
  }

// Normaliza un lotaje al paso que admite el broker
double NormalizeVol(string sym, double vol)
  {
   double step = MarketInfo(sym, MODE_LOTSTEP);
   double mn   = MarketInfo(sym, MODE_MINLOT);
   double mx   = MarketInfo(sym, MODE_MAXLOT);
   if(step <= 0) step = 0.01;
   double v = MathFloor(vol / step) * step;
   if(v < mn) return 0;
   if(mx > 0 && v > mx) v = mx;
   return NormalizeDouble(v, 2);
  }

//==================== PANEL DEL GRAFICO ===========================
void PanelLabel(string name, string text, int x, int y, color clr, int size = 8, bool bold = false)
  {
   string nm = PREFIX + name;
   if(ObjectFind(0, nm) < 0) ObjectCreate(0, nm, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, nm, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, nm, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, nm, OBJPROP_YDISTANCE, y);
   ObjectSetString(0, nm, OBJPROP_TEXT, text);
   ObjectSetInteger(0, nm, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, nm, OBJPROP_FONTSIZE, size);
   ObjectSetString(0, nm, OBJPROP_FONT, bold ? "Arial Bold" : "Arial");
   ObjectSetInteger(0, nm, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, nm, OBJPROP_BACK, false);
  }

void PanelButton(string name, string text, int x, int y, int w, int h, color bg, color txt)
  {
   string nm = PREFIX + name;
   if(ObjectFind(0, nm) < 0) ObjectCreate(0, nm, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, nm, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, nm, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, nm, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, nm, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, nm, OBJPROP_YSIZE, h);
   ObjectSetString(0, nm, OBJPROP_TEXT, text);
   ObjectSetInteger(0, nm, OBJPROP_BGCOLOR, bg);
   ObjectSetInteger(0, nm, OBJPROP_COLOR, txt);
   ObjectSetInteger(0, nm, OBJPROP_BORDER_COLOR, COL_LINE);
   ObjectSetInteger(0, nm, OBJPROP_FONTSIZE, 8);
   ObjectSetInteger(0, nm, OBJPROP_STATE, false);
   ObjectSetInteger(0, nm, OBJPROP_SELECTABLE, false);
  }

void DrawPanel()
  {
   int X = 12, W = 214, y = 22;
   int bx = X + W - 12 - 46;

   string bg = PREFIX + "bg";
   if(ObjectFind(0, bg) < 0) ObjectCreate(0, bg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, bg, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, bg, OBJPROP_XDISTANCE, X);
   ObjectSetInteger(0, bg, OBJPROP_YDISTANCE, y - 10);
   ObjectSetInteger(0, bg, OBJPROP_XSIZE, W);
   ObjectSetInteger(0, bg, OBJPROP_YSIZE, g_guardOn ? 312 : 268);
   ObjectSetInteger(0, bg, OBJPROP_BGCOLOR, COL_BG);
   ObjectSetInteger(0, bg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, bg, OBJPROP_COLOR, COL_LINE);
   ObjectSetInteger(0, bg, OBJPROP_BACK, false);
   ObjectSetInteger(0, bg, OBJPROP_SELECTABLE, false);

   PanelLabel("title", "Onyx Manager", X + 12, y, COL_TX, 9, true);
   y += PY;

   bool alive = (g_lastSyncOk > 0 && (TimeCurrent() - g_lastSyncOk) < 120);
   string st;
   if(g_lastSyncOk == 0)   st = T("Conectando...", "Connecting...");
   else if(alive)          st = T("Conectado - cuenta ", "Connected - account ") + IntegerToString(g_login);
   else                    st = T("Sin senal del servidor", "No server signal");
   PanelLabel("state", st, X + 12, y, alive ? COL_ON : COL_MUT, 8);
   y += PY;

   if(g_lastError != "")
     {
      PanelLabel("err", StringSubstr(g_lastError, 0, 32), X + 12, y, COL_RED, 7);
      y += PY - 6;
     }
   else ObjectDelete(0, PREFIX + "err");

   //---- Fase 2: estado de mi plan de trading ---------------------
   if(g_guardOn)
     {
      PanelLabel("plan", T("Mi plan", "My plan"), X + 12, y, COL_MUT, 8);
      y += PY - 2;

      string ps; color pc;
      if(g_allowNew) { ps = T("Puedes operar", "You may trade"); pc = COL_ON; }
      else           { ps = T("BLOQUEADO", "BLOCKED");           pc = COL_RED; }
      PanelLabel("pst", ps, X + 12, y, pc, 9, true);
      y += PY - 4;

      if(!g_allowNew && g_blockMsg != "")
        {
         PanelLabel("pms1", StringSubstr(g_blockMsg, 0, 34), X + 12, y, COL_MUT, 7);
         y += 13;
         if(StringLen(g_blockMsg) > 34) PanelLabel("pms2", StringSubstr(g_blockMsg, 34, 34), X + 12, y, COL_MUT, 7);
         else                           ObjectDelete(0, PREFIX + "pms2");
         y += 14;
        }
      else { ObjectDelete(0, PREFIX + "pms1"); ObjectDelete(0, PREFIX + "pms2"); y += 6; }
     }
   else
     {
      ObjectDelete(0, PREFIX + "plan"); ObjectDelete(0, PREFIX + "pst");
      ObjectDelete(0, PREFIX + "pms1"); ObjectDelete(0, PREFIX + "pms2");
     }

   PanelLabel("mods", T("Modulos", "Modules"), X + 12, y, COL_MUT, 8);
   y += PY - 2;

   PanelLabel("lbe", "Break even", X + 12, y + 3, COL_TX, 8);
   PanelButton("bbe", g_beOn ? "ON" : "OFF", bx, y, 46, 18, g_beOn ? COL_ON : COL_OFF, C'20,25,38');
   y += PY;

   PanelLabel("ltr", "Trailing stop", X + 12, y + 3, COL_TX, 8);
   PanelButton("btr", g_trOn ? "ON" : "OFF", bx, y, 46, 18, g_trOn ? COL_ON : COL_OFF, C'20,25,38');
   y += PY;

   PanelLabel("lpt", T("TP parciales", "Partial TPs"), X + 12, y + 3, COL_TX, 8);
   PanelButton("bpt", g_ptOn ? "ON" : "OFF", bx, y, 46, 18, g_ptOn ? COL_ON : COL_OFF, C'20,25,38');
   y += PY + 8;

   PanelLabel("acts", T("Acciones rapidas", "Quick actions"), X + 12, y, COL_MUT, 8);
   y += PY - 2;

   int bw = 92;
   PanelButton("bslbe", T("SL a BE", "SL to BE"),      X + 12,      y, bw, 20, C'35,44,66', COL_TX);
   PanelButton("bhalf", T("Cerrar 50%", "Close 50%"),  X + 18 + bw, y, bw, 20, C'35,44,66', COL_TX);
   y += 24;
   PanelButton("bwin",  T("Ganadoras", "Winners"),     X + 12,      y, bw, 20, C'35,44,66', COL_TX);
   PanelButton("ball",  T("Cerrar todo", "Close all"), X + 18 + bw, y, bw, 20, C'120,40,55', COL_TX);
   y += 26;

   PanelLabel("foot", T("Onyx no abre operaciones", "Onyx never opens trades"), X + 12, y, COL_MUT, 7);

   ChartRedraw();
  }

void DeletePanel()
  {
   ObjectsDeleteAll(0, PREFIX);
   ChartRedraw();
  }

//==================== CUERPO QUE SE ENVIA =========================
string BuildBody()
  {
   string s = "{";
   s += "\"apiKey\":\"" + Esc(ApiKey) + "\",";
   s += "\"eaVersion\":\"" + EA_VERSION + "\",";

   // desfase del servidor del broker respecto a UTC, en minutos
   int offset = (int)((TimeCurrent() - TimeGMT()) / 60);
   s += "\"serverOffset\":" + IntegerToString(offset) + ",";

   s += "\"account\":{";
   s += "\"login\":"    + IntegerToString(AccountNumber()) + ",";
   s += "\"broker\":\"" + Esc(AccountCompany()) + "\",";
   s += "\"server\":\"" + Esc(AccountServer()) + "\",";
   s += "\"name\":\""   + Esc(AccountName()) + "\",";
   s += "\"currency\":\"" + Esc(AccountCurrency()) + "\",";
   s += "\"leverage\":" + IntegerToString(AccountLeverage()) + ",";
   s += "\"platform\":\"MT4\",";
   s += "\"balance\":"  + DoubleToString(AccountBalance(), 2) + ",";
   s += "\"equity\":"   + DoubleToString(AccountEquity(), 2);
   s += "},";

   //---- posiciones abiertas ----
   s += "\"openPositions\":[";
   bool first = true;
   for(int i = 0; i < OrdersTotal(); i++)
     {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderType() > OP_SELL) continue;             // ignora las pendientes
      if(!first) s += ",";
      first = false;
      s += "{";
      s += "\"ticket\":"    + IntegerToString(OrderTicket()) + ",";
      s += "\"symbol\":\""  + Esc(OrderSymbol()) + "\",";
      s += "\"side\":\""    + (OrderType() == OP_BUY ? "buy" : "sell") + "\",";
      s += "\"volume\":"    + DoubleToString(OrderLots(), 2) + ",";
      s += "\"openTime\":"  + IntegerToString((int)OrderOpenTime()) + ",";
      s += "\"openPrice\":" + DoubleToString(OrderOpenPrice(), 5) + ",";
      s += "\"sl\":"        + DoubleToString(OrderStopLoss(), 5) + ",";
      s += "\"tp\":"        + DoubleToString(OrderTakeProfit(), 5) + ",";
      s += "\"profit\":"    + DoubleToString(OrderProfit(), 2);
      s += "}";
     }
   s += "],";

   //---- operaciones cerradas desde la ultima vez ----
   s += "\"closedTrades\":[";
   first = true;
   datetime maxClose = g_lastClose;
   for(int j = 0; j < OrdersHistoryTotal(); j++)
     {
      if(!OrderSelect(j, SELECT_BY_POS, MODE_HISTORY)) continue;
      if(OrderType() > OP_SELL) continue;             // ni balance ni credito
      datetime ct = OrderCloseTime();
      if(ct <= g_lastClose) continue;
      if(ct > maxClose) maxClose = ct;

      double prof = OrderProfit(), comm = OrderCommission(), sw = OrderSwap();
      if(!first) s += ",";
      first = false;
      s += "{";
      s += "\"ticket\":"     + IntegerToString(OrderTicket()) + ",";
      s += "\"symbol\":\""   + Esc(OrderSymbol()) + "\",";
      s += "\"side\":\""     + (OrderType() == OP_BUY ? "buy" : "sell") + "\",";
      s += "\"volume\":"     + DoubleToString(OrderLots(), 2) + ",";
      s += "\"openTime\":"   + IntegerToString((int)OrderOpenTime()) + ",";
      s += "\"openPrice\":"  + DoubleToString(OrderOpenPrice(), 5) + ",";
      s += "\"closeTime\":"  + IntegerToString((int)ct) + ",";
      s += "\"closePrice\":" + DoubleToString(OrderClosePrice(), 5) + ",";
      s += "\"profit\":"     + DoubleToString(prof, 2) + ",";
      s += "\"commission\":" + DoubleToString(comm, 2) + ",";
      s += "\"swap\":"       + DoubleToString(sw, 2) + ",";
      s += "\"netProfit\":"  + DoubleToString(prof + comm + sw, 2);
      s += "}";
     }
   s += "],";
   g_lastClose = maxClose;

   s += "\"events\":[" + g_events + "],";
   s += "\"doneCommands\":[" + g_doneCmds + "]";
   s += "}";
   return s;
  }

//==================== CONFIGURACION QUE LLEGA =====================
void ApplyConfig(string resp)
  {
   if(StringFind(resp, "\"config\":null") >= 0)
     {
      g_managerOn = false;
      g_beOn = false; g_trOn = false; g_ptOn = false;
      g_guardOn = false; g_wkOn = false;
      g_allowNew = true; g_forceClose = false; g_blockReason = ""; g_blockMsg = "";
      return;
     }

   string cfg = JsonSection(resp, "config");
   if(cfg == "") return;

   int ver = (int)JsonNum(cfg, "version", 0);
   if(ver == g_cfgVersion) return;
   g_cfgVersion = ver;
   g_managerOn  = true;
   g_units      = JsonStr(cfg, "units", "pips");

   string be = JsonSection(cfg, "breakeven");
   g_beOn      = JsonBool(be, "on", false);
   g_beTrigger = JsonNum(be, "trigger", 15);
   g_beMode    = JsonStr(be, "mode", "above");
   g_beOffset  = JsonNum(be, "offset", 2);
   g_beCosts   = JsonBool(be, "cover_costs", true);

   string tr = JsonSection(cfg, "trailing");
   g_trOn       = JsonBool(tr, "on", false);
   g_trStart    = JsonNum(tr, "start", 20);
   g_trDistance = JsonNum(tr, "distance", 20);

   g_ptCount = 0; g_ptOn = false;
   string arr = JsonArray(cfg, "partials");
   if(arr != "" && StringLen(arr) > 2)
     {
      int pos = 0;
      while(g_ptCount < 4)
        {
         int b = StringFind(arr, "{", pos);
         if(b < 0) break;
         int e = StringFind(arr, "}", b);
         if(e < 0) break;
         string it = StringSubstr(arr, b, e - b + 1);
         double at = JsonNum(it, "at", 0);
         double cl = JsonNum(it, "close", 0);
         if(at > 0 && cl > 0) { g_ptAt[g_ptCount] = at; g_ptClose[g_ptCount] = cl; g_ptCount++; }
         pos = e + 1;
        }
      g_ptOn = (g_ptCount > 0);
     }

   //---- Fase 2: cierre de fin de semana --------------------------
   string pl = JsonSection(cfg, "plan");
   g_guardOn = JsonBool(pl, "on", false);
   g_wkOn = false;
   if(pl != "")
     {
      string wk = JsonSection(pl, "weekend_close");
      if(wk != "")
        {
         g_wkOn  = JsonBool(wk, "on", false);
         g_wkDay = (int)JsonNum(wk, "day", 5);
         string hm = JsonStr(wk, "time", "20:00");
         int c = StringFind(hm, ":");
         if(c > 0)
           {
            g_wkHour = (int)StringToInteger(StringSubstr(hm, 0, c));
            g_wkMin  = (int)StringToInteger(StringSubstr(hm, c + 1));
           }
        }
     }
   string li = JsonSection(cfg, "limits");
   if(JsonBool(li, "on", false)) g_guardOn = true;

   Print("Onyx: ", T("configuracion actualizada v", "config updated v"), g_cfgVersion);
  }

//==================== VEREDICTO DEL SERVIDOR ======================
// El servidor decide si puede operar. Aqui solo obedecemos.
void ApplyVerdict(string resp)
  {
   if(StringFind(resp, "\"verdict\":null") >= 0)
     {
      g_allowNew = true; g_forceClose = false;
      g_blockReason = ""; g_blockMsg = ""; g_blockSince = 0;
      return;
     }

   string v = JsonSection(resp, "verdict");
   if(v == "") return;

   bool allow    = JsonBool(v, "allow_new", true);
   g_forceClose  = JsonBool(v, "close_all", false);
   g_blockReason = JsonStr(v, "reason", "");
   g_blockMsg    = JsonStr(v, (Idioma == ONYX_ES ? "message_es" : "message_en"), "");

   // Solo cerramos lo que se abra DESPUES del bloqueo
   if(!allow && g_allowNew) g_blockSince = TimeCurrent();
   if(allow) g_blockSince = 0;
   g_allowNew = allow;
  }

//==================== ORDENES DEL PANEL WEB =======================
void HandleCommands(string resp)
  {
   string arr = JsonArray(resp, "commands");
   if(arr == "" || StringLen(arr) < 4) return;

   g_doneCmds = "";
   int pos = 0;
   while(true)
     {
      int b = StringFind(arr, "{", pos);
      if(b < 0) break;
      int e = StringFind(arr, "}", b);
      if(e < 0) break;
      string it  = StringSubstr(arr, b, e - b + 1);
      string id  = JsonStr(it, "id", "");
      string cmd = JsonStr(it, "command", "");
      if(cmd != "")
        {
         RunCommand(cmd);
         if(id != "")
           {
            if(g_doneCmds != "") g_doneCmds += ",";
            g_doneCmds += "\"" + id + "\"";
           }
        }
      pos = e + 1;
     }
  }

//==================== SINCRONIZACION ==============================
void Sync()
  {
   if(ApiKey == "") { g_lastError = T("Falta la API key", "API key missing"); return; }

   char post[], result[];
   string headers = "Content-Type: application/json\r\n";
   string body = BuildBody();

   int blen = StringToCharArray(body, post, 0, StringLen(body), CP_UTF8);
   if(blen > 0) ArrayResize(post, blen);

   string resHeaders;
   ResetLastError();
   int code = WebRequest("POST", g_url, headers, 15000, post, result, resHeaders);

   if(code == -1)
     {
      int err = GetLastError();
      if(err == 4060 || err == 4014) g_lastError = T("Permite la URL en Opciones", "Allow the URL in Options");
      else                           g_lastError = T("Error de red ", "Network error ") + IntegerToString(err);
      return;
     }

   string resp = CharArrayToString(result, 0, -1, CP_UTF8);

   if(code != 200)
     {
      string msg = JsonStr(resp, "error", "");
      g_lastError = (msg != "" ? StringSubstr(msg, 0, 60) : "HTTP " + IntegerToString(code));
      return;
     }

   g_lastError  = "";
   g_lastSyncOk = TimeCurrent();
   g_events     = "";              // ya viajaron
   g_doneCmds   = "";

   GlobalVariableSet(PREFIX + "lc_" + IntegerToString(AccountNumber()), (double)g_lastClose);

   ApplyConfig(resp);
   ApplyVerdict(resp);
   HandleCommands(resp);
  }

//==================== PARCIALES: MEMORIA ==========================
// OJO, esto es distinto de MT5. Cuando cierras parte de una posicion,
// MT4 le da un ticket NUEVO al resto. Si guardaramos por ticket, al
// primer parcial perderiamos la cuenta y volveria a ejecutarlos todos.
// Por eso la clave es simbolo + hora de apertura, que si sobreviven.
string PartialKey(string sym, datetime openTime)
  {
   string s = sym;
   if(StringLen(s) > 10) s = StringSubstr(s, 0, 10);
   return PREFIX + "p_" + s + "_" + IntegerToString((int)openTime);
  }

bool PartialDone(string sym, datetime openTime, int level)
  {
   string k = PartialKey(sym, openTime);
   if(!GlobalVariableCheck(k)) return false;
   int mask = (int)GlobalVariableGet(k);
   return ((mask & (1 << level)) != 0);
  }

void MarkPartial(string sym, datetime openTime, int level)
  {
   string k = PartialKey(sym, openTime);
   int mask = GlobalVariableCheck(k) ? (int)GlobalVariableGet(k) : 0;
   mask = mask | (1 << level);
   GlobalVariableSet(k, (double)mask);
  }

// Limpia marcas viejas para no dejar basura en el terminal
void CleanOldPartials()
  {
   int total = GlobalVariablesTotal();
   for(int i = total - 1; i >= 0; i--)
     {
      string nm = GlobalVariableName(i);
      if(StringFind(nm, PREFIX + "p_") != 0) continue;
      if(TimeCurrent() - (datetime)GlobalVariableTime(nm) > 30 * 86400)
         GlobalVariableDel(nm);
     }
  }

//==================== GESTION DE UNA POSICION =====================
void ManagePosition(int ticket)
  {
   if(!OrderSelect(ticket, SELECT_BY_TICKET)) return;
   if(OrderCloseTime() > 0) return;            // ya esta cerrada
   if(OrderType() > OP_SELL) return;           // pendiente

   string   sym    = OrderSymbol();
   bool     isBuy  = (OrderType() == OP_BUY);
   double   entry  = OrderOpenPrice();
   double   sl     = OrderStopLoss();
   double   tp     = OrderTakeProfit();
   double   lots   = OrderLots();
   datetime opened = OrderOpenTime();

   double point = MarketInfo(sym, MODE_POINT);
   int    dig   = (int)MarketInfo(sym, MODE_DIGITS);
   double bid   = MarketInfo(sym, MODE_BID);
   double ask   = MarketInfo(sym, MODE_ASK);
   if(point <= 0 || bid <= 0 || ask <= 0) return;

   double cur      = isBuy ? bid : ask;
   double progress = isBuy ? (cur - entry) : (entry - cur);   // a favor, en precio
   if(progress <= 0 && !g_forceClose) { /* seguimos: puede haber parciales pendientes */ }

   // distancia minima al precio que exige el broker
   double stopLevel = MarketInfo(sym, MODE_STOPLEVEL) * point;

   //---------- BREAK EVEN ----------
   if(g_beOn)
     {
      double trigger = UnitsToPrice(sym, g_beTrigger, lots, entry, sl);
      if(trigger > 0 && progress >= trigger)
        {
         double extra = 0;

         if(g_beMode == "above")
           {
            extra = UnitsToPrice(sym, g_beOffset, lots, entry, sl);

            // Cubrir comision y swap reales. En MT4 los tenemos a mano,
            // sin tener que rebuscar en el historial como en MT5.
            if(g_beCosts)
              {
               double costs = MathAbs(OrderCommission()) + MathAbs(OrderSwap());
               double mpp   = MoneyPerPointPerLot(sym);
               if(mpp > 0 && lots > 0 && costs > 0)
                  extra += (costs / (mpp * lots)) * point;
              }
           }
         else if(g_beMode == "below")
            extra = -UnitsToPrice(sym, g_beOffset, lots, entry, sl);
         // "at" deja extra en 0: justo en la entrada

         double target = isBuy ? (entry + extra) : (entry - extra);
         target = NormalizeDouble(target, dig);

         // solo si mejora el stop actual y el broker lo admite
         bool better = isBuy ? (sl <= 0 || target > sl) : (sl <= 0 || target < sl);
         bool valid  = isBuy ? (target < bid - stopLevel) : (target > ask + stopLevel);

         if(better && valid)
           {
            if(OrderModify(ticket, entry, target, tp, 0, clrNONE))
              {
               LogEvent("breakeven", T("Stop movido a break even", "Stop moved to break even"), sym, ticket);
               sl = target;
              }
           }
        }
     }

   //---------- TRAILING ----------
   if(g_trOn)
     {
      double start = UnitsToPrice(sym, g_trStart, lots, entry, sl);
      if(start > 0 && progress >= start)
        {
         double dist   = UnitsToPrice(sym, g_trDistance, lots, entry, sl);
         double target = isBuy ? (cur - dist) : (cur + dist);
         target = NormalizeDouble(target, dig);

         bool better = isBuy ? (sl <= 0 || target > sl) : (sl <= 0 || target < sl);
         bool valid  = isBuy ? (target < bid - stopLevel) : (target > ask + stopLevel);

         if(better && valid)
           {
            if(OrderModify(ticket, entry, target, tp, 0, clrNONE))
               LogEvent("trailing", T("Stop desplazado", "Stop trailed"), sym, ticket);
           }
        }
     }

   //---------- TP PARCIALES ----------
   if(g_ptOn && g_ptCount > 0)
     {
      for(int L = 0; L < g_ptCount; L++)
        {
         if(PartialDone(sym, opened, L)) continue;

         double lvl = UnitsToPrice(sym, g_ptAt[L], lots, entry, sl);
         if(lvl <= 0 || progress < lvl) continue;

         double closeVol = NormalizeVol(sym, lots * (g_ptClose[L] / 100.0));
         if(closeVol <= 0)
           {
            // Con 0.01 lotes el broker no deja partir. Lo marcamos como
            // hecho para no reintentarlo en cada tick, y lo contamos.
            MarkPartial(sym, opened, L);
            LogEvent("info", T("Parcial omitido: lote minimo", "Partial skipped: minimum lot"), sym, ticket);
            continue;
           }
         if(closeVol >= lots) closeVol = lots;

         double price = isBuy ? bid : ask;
         if(OrderClose(ticket, closeVol, price, 30, clrNONE))
           {
            MarkPartial(sym, opened, L);
            LogEvent("partial", T("Cierre parcial ", "Partial close ") +
                     DoubleToString(g_ptClose[L], 0) + "%", sym, ticket, closeVol);
            // El resto tiene otro ticket: dejamos de tocar esta pasada
            return;
           }
        }
     }
  }

//==================== RECORRER TODAS ==============================
// Recogemos los tickets primero. Si cerramos mientras recorremos por
// posicion, los indices se mueven bajo los pies y saltamos ordenes.
void ManageAll()
  {
   if(!g_managerOn) return;
   if(!g_beOn && !g_trOn && !g_ptOn) return;

   int tickets[];
   int n = 0;
   ArrayResize(tickets, OrdersTotal());
   for(int i = 0; i < OrdersTotal(); i++)
     {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderType() > OP_SELL) continue;
      tickets[n] = OrderTicket();
      n++;
     }
   ArrayResize(tickets, n);

   for(int k = 0; k < n; k++) ManagePosition(tickets[k]);
  }

//==================== APLICAR EL BLOQUEO ==========================
// MetaTrader no deja a un EA vetar una orden manual antes de enviarse.
// Lo que si podemos es cerrarla nada mas aparecer. Tiene un coste real
// (spread + comision), y ese coste ES la friccion.
void EnforceGuard()
  {
   if(!g_managerOn) return;

   if(g_forceClose)
     {
      if(OrdersTotal() > 0)
        {
         RunCommand("close_all");
         LogEvent("limit", g_blockMsg != "" ? g_blockMsg : T("Cierre por limite", "Closed by limit"));
        }
      return;
     }

   if(g_allowNew || g_blockSince == 0) return;

   int tickets[];
   int n = 0;
   ArrayResize(tickets, OrdersTotal());
   for(int i = 0; i < OrdersTotal(); i++)
     {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderType() > OP_SELL) continue;
      if(OrderOpenTime() < g_blockSince) continue;   // ya estaba abierta: no se toca
      tickets[n] = OrderTicket();
      n++;
     }
   ArrayResize(tickets, n);

   for(int k = 0; k < n; k++)
     {
      if(!OrderSelect(tickets[k], SELECT_BY_TICKET)) continue;
      if(OrderCloseTime() > 0) continue;
      string sym  = OrderSymbol();
      double lots = OrderLots();
      double price = (OrderType() == OP_BUY) ? MarketInfo(sym, MODE_BID) : MarketInfo(sym, MODE_ASK);
      if(OrderClose(tickets[k], lots, price, 30, clrNONE))
        {
         LogEvent("blocked",
                  T("Operacion fuera del plan cerrada: ", "Trade outside plan closed: ") +
                  (g_blockReason != "" ? g_blockReason : "?"),
                  sym, tickets[k], lots);
         Print("Onyx: ", T("cerrada por el plan de trading - ", "closed by trading plan - "), g_blockMsg);
        }
     }
  }

//==================== CIERRE DE FIN DE SEMANA =====================
void WeekendCheck()
  {
   if(!g_managerOn || !g_wkOn) return;
   if(OrdersTotal() == 0) return;

   MqlDateTime now;
   TimeToStruct(TimeCurrent(), now);
   if(now.day_of_week != g_wkDay) return;

   int mins   = now.hour * 60 + now.min;
   int target = g_wkHour * 60 + g_wkMin;
   if(mins < target) return;

   if(g_wkDoneAt > 0 && (TimeCurrent() - g_wkDoneAt) < 12 * 3600) return;
   g_wkDoneAt = TimeCurrent();

   RunCommand("close_all");
   LogEvent("close_all", T("Cierre antes del fin de semana", "Closed before the weekend"));
  }

//==================== ACCIONES RAPIDAS ============================
void RunCommand(string cmd)
  {
   int tickets[];
   int n = 0;
   ArrayResize(tickets, OrdersTotal());
   for(int i = 0; i < OrdersTotal(); i++)
     {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderType() > OP_SELL) continue;
      tickets[n] = OrderTicket();
      n++;
     }
   ArrayResize(tickets, n);

   int done = 0;

   for(int k = 0; k < n; k++)
     {
      int tk = tickets[k];
      if(!OrderSelect(tk, SELECT_BY_TICKET)) continue;
      if(OrderCloseTime() > 0) continue;

      string sym   = OrderSymbol();
      bool   isBuy = (OrderType() == OP_BUY);
      double lots  = OrderLots();
      double prof  = OrderProfit() + OrderCommission() + OrderSwap();
      double price = isBuy ? MarketInfo(sym, MODE_BID) : MarketInfo(sym, MODE_ASK);

      if(cmd == "close_all")
        {
         if(OrderClose(tk, lots, price, 30, clrNONE)) done++;
        }
      else if(cmd == "close_profitable")
        {
         if(prof > 0 && OrderClose(tk, lots, price, 30, clrNONE)) done++;
        }
      else if(cmd == "close_losing")
        {
         if(prof < 0 && OrderClose(tk, lots, price, 30, clrNONE)) done++;
        }
      else if(cmd == "close_half")
        {
         double half = NormalizeVol(sym, lots / 2.0);
         if(half > 0 && half < lots)
           {
            if(OrderClose(tk, half, price, 30, clrNONE)) done++;
           }
        }
      else if(cmd == "sl_to_be")
        {
         double entry = OrderOpenPrice();
         double sl    = OrderStopLoss();
         double tp    = OrderTakeProfit();
         int    dig   = (int)MarketInfo(sym, MODE_DIGITS);
         double point = MarketInfo(sym, MODE_POINT);
         double bid   = MarketInfo(sym, MODE_BID);
         double ask   = MarketInfo(sym, MODE_ASK);
         double stopLevel = MarketInfo(sym, MODE_STOPLEVEL) * point;

         double extra = 0;
         double costs = MathAbs(OrderCommission()) + MathAbs(OrderSwap());
         double mpp   = MoneyPerPointPerLot(sym);
         if(mpp > 0 && lots > 0 && costs > 0) extra = (costs / (mpp * lots)) * point;

         double target = NormalizeDouble(isBuy ? entry + extra : entry - extra, dig);
         bool better = isBuy ? (sl <= 0 || target > sl) : (sl <= 0 || target < sl);
         bool valid  = isBuy ? (target < bid - stopLevel) : (target > ask + stopLevel);

         if(better && valid && OrderModify(tk, entry, target, tp, 0, clrNONE)) done++;
        }
     }

   string txt;
   if(cmd == "close_all")             txt = T("Cerradas todas", "Closed all");
   else if(cmd == "close_profitable") txt = T("Cerradas las ganadoras", "Closed winners");
   else if(cmd == "close_losing")     txt = T("Cerradas las perdedoras", "Closed losers");
   else if(cmd == "close_half")       txt = T("Cerrada la mitad", "Closed half");
   else if(cmd == "sl_to_be")         txt = T("Stops a break even", "Stops to break even");
   else                               txt = cmd;

   LogEvent(cmd == "close_all" ? "close_all" : "info", txt + " (" + IntegerToString(done) + ")", "", 0, done);
   Print("Onyx: ", txt, " (", done, ")");
  }

//==================== CICLO DE VIDA ===============================
int OnInit()
  {
   g_url   = ServidorUrl;
   g_login = AccountNumber();

   if(ApiKey == "")
      Print("Onyx: ", T("falta la API key. Cogela de onyxtradinglive.com",
                        "API key missing. Get it at onyxtradinglive.com"));

   // desde cuando pedir historial la primera vez
   string k = PREFIX + "lc_" + IntegerToString(AccountNumber());
   if(GlobalVariableCheck(k)) g_lastClose = (datetime)GlobalVariableGet(k);
   else                       g_lastClose = TimeCurrent() - 120 * 86400;

   CleanOldPartials();
   EventSetTimer(30);
   DrawPanel();
   Sync();
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   DeletePanel();
  }

void OnTimer()
  {
   Sync();
   EnforceGuard();
   WeekendCheck();
   ManageAll();
   DrawPanel();
  }

void OnTick()
  {
   EnforceGuard();       // si abre fuera de su plan, se cierra al instante
   ManageAll();          // reaccionar rapido entre sincronizaciones
  }

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
  {
   if(id != CHARTEVENT_OBJECT_CLICK) return;
   if(StringFind(sparam, PREFIX) != 0) return;

   ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
   string name = StringSubstr(sparam, StringLen(PREFIX));

   // Los ON/OFF del panel apagan modulos AQUI, en este terminal.
   // La configuracion de la web manda: en la siguiente sincronizacion
   // con version nueva se vuelve a aplicar lo que tengas guardado.
   if(name == "bbe")      { g_beOn = !g_beOn; }
   else if(name == "btr") { g_trOn = !g_trOn; }
   else if(name == "bpt") { g_ptOn = !g_ptOn; }
   else if(name == "bslbe") RunCommand("sl_to_be");
   else if(name == "bhalf") RunCommand("close_half");
   else if(name == "bwin")  RunCommand("close_profitable");
   else if(name == "ball")  RunCommand("close_all");

   DrawPanel();
  }
//+------------------------------------------------------------------+
